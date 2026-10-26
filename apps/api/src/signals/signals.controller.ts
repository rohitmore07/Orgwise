import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common/decorators/public.decorator';
// Value import, not `type`: Nest resolves the controller's dependency via emitted decorator metadata…
// (`design:paramtypes`). A type-only import is elided at runtime, leaving an unresolvable `undefined` in the…
import { SignalsService } from './signals.service';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Public()
  @Get('live')
  getLive() {
    return this.signalsService.getLiveSnapshot();
  }
}
