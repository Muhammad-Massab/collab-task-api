import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './task.entity';
import { User } from '../users/user.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, User]), EventsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
