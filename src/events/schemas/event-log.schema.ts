import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventLogDocument = HydratedDocument<EventLog>;

@Schema({ collection: 'event_logs', timestamps: true })
export class EventLog {
  @Prop({ required: true })
  eventType: string;

  @Prop({ type: Object })
  payload: Record<string, any>;

  @Prop()
  userId?: string;

  @Prop()
  correlationId?: string;
}

export const EventLogSchema = SchemaFactory.createForClass(EventLog);

EventLogSchema.index({ eventType: 1, createdAt: -1 });
