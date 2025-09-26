import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventLog, EventLogSchema } from './schemas/event-log.schema';
import { EventsService } from './events.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventLog.name, schema: EventLogSchema },
    ]),
  ],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
