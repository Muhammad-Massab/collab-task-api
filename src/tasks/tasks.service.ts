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

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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

    return this.tasksRepository.save(task);
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
    return this.tasksRepository.save(task);
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.findOne(id, userId);

    if (task.createdById !== userId) {
      throw new ForbiddenException(
        'Only the task creator can delete this task',
      );
    }

    await this.tasksRepository.remove(task);
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
