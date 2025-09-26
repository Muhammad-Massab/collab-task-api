import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private readonly eventsService: EventsService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: User; token: string }> {
    const { email, password, firstName, lastName } = registerDto;

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = this.usersRepository.create({
      email,
      firstName,
      lastName,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);

    const payload = { sub: savedUser.id, email: savedUser.email };
    const token = this.jwtService.sign(payload);

    delete savedUser.password;

    await this.eventsService.logEvent({
      eventType: 'auth.registered',
      payload: { userId: savedUser.id, email: savedUser.email },
      userId: savedUser.id,
    });
    return { user: savedUser, token };
  }

  async login(loginDto: LoginDto): Promise<{ user: User; token: string }> {
    const { email, password } = loginDto;

    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    delete user.password;

    await this.eventsService.logEvent({
      eventType: 'auth.logged_in',
      payload: { userId: user.id, email: user.email },
      userId: user.id,
    });
    return { user, token };
  }

  async validateUser(payload: { sub: string; email: string }): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
