import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventLog, EventLogDocument } from './schemas/event-log.schema';

export interface CreateEventLogInput {
  eventType: string;
  payload?: Record<string, any>;
  userId?: string;
  correlationId?: string;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(EventLog.name)
    private readonly eventLogModel: Model<EventLogDocument>,
  ) {}

  async logEvent(input: CreateEventLogInput): Promise<EventLog> {
    const eventLog = new this.eventLogModel({
      eventType: input.eventType,
      payload: input.payload ?? {},
      userId: input.userId,
      correlationId: input.correlationId,
    });
    return eventLog.save();
  }

  async findRecentByType(eventType: string, limit = 50): Promise<EventLog[]> {
    return this.eventLogModel
      .find({ eventType })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
