import * as nestCommon from '@nestjs/common';
import { AppService } from './app.service';

@nestCommon.Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @nestCommon.Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
