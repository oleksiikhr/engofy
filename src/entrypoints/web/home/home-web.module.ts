import { Module } from '@nestjs/common';
import { HomeModule } from '../../../modules/home/home.module.js';
import { HomeController } from './controllers/home.controller.js';

@Module({
  imports: [HomeModule],
  controllers: [HomeController],
})
export class HomeWebModule {}
