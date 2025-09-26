import { registerAs } from '@nestjs/config';

export default registerAs('mongodb', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  database: process.env.MONGODB_DATABASE || 'collab_task_events',
  user: process.env.MONGODB_USERNAME,
  pass: process.env.MONGODB_PASSWORD,
}));
