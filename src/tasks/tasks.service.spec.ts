/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task, TaskStatus, TaskPriority } from './task.entity';
import { User } from '../users/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { EventsService } from '../events/events.service';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: jest.Mocked<Repository<Task>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<Task>>;

  const mockUser: Partial<User> = {
    id: 'user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockAssignedUser: Partial<User> = {
    id: 'assigned-user-id',
    email: 'assigned@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
  };

  const mockTask: Partial<Task> = {
    id: 'task-id',
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    createdById: 'user-id',
    assignedUserId: 'assigned-user-id',
    createdBy: mockUser as User,
    assignedUser: mockAssignedUser as User,
  };

  beforeEach(async () => {
    queryBuilder = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    } as any;

    const mockTaskRepository = {
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: EventsService,
          useValue: { logEvent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    taskRepository = module.get(getRepositoryToken(Task));
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createTaskDto: CreateTaskDto = {
      title: 'New Task',
      description: 'New Description',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assignedUserId: 'assigned-user-id',
    };

    it('should successfully create a task', async () => {
      userRepository.findOne.mockResolvedValue(mockAssignedUser as User);
      taskRepository.create.mockReturnValue(mockTask);
      taskRepository.save.mockResolvedValue(mockTask);

      const result = await service.create(createTaskDto, 'user-id');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: createTaskDto.assignedUserId },
      });
      expect(taskRepository.create).toHaveBeenCalledWith({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        priority: createTaskDto.priority,
        createdById: 'user-id',
        assignedUserId: createTaskDto.assignedUserId,
      });
      expect(result).toEqual(mockTask);
    });

    it('should create task without assigned user', async () => {
      const createTaskDtoWithoutAssignee = {
        ...createTaskDto,
        assignedUserId: undefined,
      };

      taskRepository.create.mockReturnValue(mockTask);
      taskRepository.save.mockResolvedValue(mockTask);

      const result = await service.create(
        createTaskDtoWithoutAssignee,
        'user-id',
      );

      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if assigned user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createTaskDto, 'user-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all tasks for a specific user', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask] as Task[]);

      const result = await service.findAll('user-id');

      expect(taskRepository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'task.assignedUser',
        'assignedUser',
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'task.createdBy',
        'createdBy',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'task.assignedUserId = :userId OR task.createdById = :userId',
        { userId: 'user-id' },
      );
      expect(result).toEqual([mockTask]);
    });

    it('should return all tasks when no userId provided', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask] as Task[]);

      const result = await service.findAll();

      expect(queryBuilder.where).not.toHaveBeenCalled();
      expect(result).toEqual([mockTask]);
    });
  });

  describe('findOne', () => {
    it('should return a task by id for authorized user', async () => {
      queryBuilder.getOne.mockResolvedValue(mockTask);

      const result = await service.findOne('task-id', 'user-id');

      expect(queryBuilder.where).toHaveBeenCalledWith('task.id = :id', {
        id: 'task-id',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(task.assignedUserId = :userId OR task.createdById = :userId)',
        { userId: 'user-id' },
      );
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if task not found', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne('task-id', 'user-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateTaskDto: UpdateTaskDto = {
      title: 'Updated Task',
      status: TaskStatus.IN_PROGRESS,
    };

    it('should successfully update a task by creator', async () => {
      const taskToUpdate = {
        ...mockTask,
        createdById: 'user-id',
        assignedUserId: null,
      };
      queryBuilder.getOne.mockResolvedValue(taskToUpdate as Task);
      taskRepository.save.mockResolvedValue(taskToUpdate as Task);

      const result = await service.update('task-id', updateTaskDto, 'user-id');

      expect(taskRepository.save).toHaveBeenCalledWith({
        ...taskToUpdate,
        ...updateTaskDto,
        assignedUserId: undefined,
      });
      expect(result).toEqual(taskToUpdate);
    });

    it('should successfully update a task by assigned user', async () => {
      const taskToUpdate = { ...mockTask, assignedUserId: 'user-id' };
      queryBuilder.getOne.mockResolvedValue(taskToUpdate as Task);
      taskRepository.save.mockResolvedValue(taskToUpdate as Task);

      const result = await service.update('task-id', updateTaskDto, 'user-id');

      expect(result).toEqual(taskToUpdate);
    });

    it('should throw ForbiddenException if user not authorized to update', async () => {
      const taskToUpdate = {
        ...mockTask,
        createdById: 'other-user-id',
        assignedUserId: 'other-assigned-user-id',
      };
      queryBuilder.getOne.mockResolvedValue(taskToUpdate as Task);

      await expect(
        service.update('task-id', updateTaskDto, 'user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should successfully remove a task by creator', async () => {
      const taskToRemove = { ...mockTask, createdById: 'user-id' };
      queryBuilder.getOne.mockResolvedValue(taskToRemove as Task);
      taskRepository.remove.mockResolvedValue(taskToRemove as Task);

      await service.remove('task-id', 'user-id');

      expect(taskRepository.remove).toHaveBeenCalledWith(taskToRemove);
    });

    it('should throw ForbiddenException if not creator tries to delete', async () => {
      const taskToRemove = { ...mockTask, createdById: 'other-user-id' };
      queryBuilder.getOne.mockResolvedValue(taskToRemove as Task);

      await expect(service.remove('task-id', 'user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findMyTasks', () => {
    it('should return tasks assigned to user', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask] as Task[]);

      const result = await service.findMyTasks('user-id');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'task.assignedUserId = :userId',
        {
          userId: 'user-id',
        },
      );
      expect(result).toEqual([mockTask]);
    });
  });

  describe('findCreatedTasks', () => {
    it('should return tasks created by user', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask] as Task[]);

      const result = await service.findCreatedTasks('user-id');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'task.createdById = :userId',
        {
          userId: 'user-id',
        },
      );
      expect(result).toEqual([mockTask]);
    });
  });
});
