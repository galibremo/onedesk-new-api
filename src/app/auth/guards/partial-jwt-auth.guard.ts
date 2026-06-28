import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PartialJwtAuthGuard extends AuthGuard('jwt-partial') {}
