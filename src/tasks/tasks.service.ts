import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly eventsService: EventsService,
  ) {}

  async create(
    createTaskDto: CreateTaskDto,
    createdById: string,
  ): Promise<Task> {
    const { assignedUserId, ...taskData } = createTaskDto;

    if (assignedUserId) {
      const assignedUser = await this.usersRepository.findOne({
        where: { id: assignedUserId },
      });
      if (!assignedUser) {
        throw new NotFoundException('Assigned user not found');
      }
    }

    const task = this.tasksRepository.create({
      ...taskData,
      createdById,
      assignedUserId,
    });

    const saved = await this.tasksRepository.save(task);
    await this.eventsService.logEvent({
      eventType: 'task.created',
      payload: { taskId: saved.id, title: saved.title, assignedUserId },
      userId: createdById,
    });
    return saved;
  }

  async findAll(userId?: string): Promise<Task[]> {
    const query = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedUser', 'assignedUser')
      .leftJoinAndSelect('task.createdBy', 'createdBy');

    if (userId) {
      query.where(
        'task.assignedUserId = :userId OR task.createdById = :userId',
        {
          userId,
        },
      );
    }

    return query.getMany();
  }

  async findOne(id: string, userId?: string): Promise<Task> {
    const query = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedUser', 'assignedUser')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.id = :id', { id });

    if (userId) {
      query.andWhere(
        '(task.assignedUserId = :userId OR task.createdById = :userId)',
        {
          userId,
        },
      );
    }

    const task = await query.getOne();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    const task = await this.findOne(id, userId);

    if (task.createdById !== userId && task.assignedUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this task',
      );
    }

    const { assignedUserId, ...taskData } = updateTaskDto;

    if (assignedUserId) {
      const assignedUser = await this.usersRepository.findOne({
        where: { id: assignedUserId },
      });
      if (!assignedUser) {
        throw new NotFoundException('Assigned user not found');
      }
    }

    Object.assign(task, { ...taskData, assignedUserId });
    const updated = await this.tasksRepository.save(task);
    await this.eventsService.logEvent({
      eventType: 'task.updated',
      payload: { taskId: updated.id, changes: updateTaskDto },
      userId,
    });
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.findOne(id, userId);

    if (task.createdById !== userId) {
      throw new ForbiddenException(
        'Only the task creator can delete this task',
      );
    }

    await this.tasksRepository.remove(task);
    await this.eventsService.logEvent({
      eventType: 'task.deleted',
      payload: { taskId: id },
      userId,
    });
  }

  async findMyTasks(userId: string): Promise<Task[]> {
    return this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedUser', 'assignedUser')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.assignedUserId = :userId', { userId })
      .getMany();
  }

  async findCreatedTasks(userId: string): Promise<Task[]> {
    return this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedUser', 'assignedUser')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.createdById = :userId', { userId })
      .getMany();
  }
}
