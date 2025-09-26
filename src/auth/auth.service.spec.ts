/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { EventsService } from '../events/events.service';

jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: Partial<User> = {
    id: 'test-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashedPassword',
    isActive: true,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: EventsService,
          useValue: { logEvent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'password123',
    };

    it('should successfully register a new user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      userRepository.create.mockReturnValue(mockUser as User);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        password: 'hashedPassword',
      } as User);
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(registerDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        password: 'hashedPassword',
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        }),
        token: 'jwt-token',
      });
      expect(result.user.password).toBeUndefined();
    });

    it('should throw ConflictException if user already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      const mockUserWithPassword = { ...mockUser, password: 'hashedPassword' };
      userRepository.findOne.mockResolvedValue(mockUserWithPassword as User);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        'hashedPassword',
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        }),
        token: 'jwt-token',
      });
      expect(result.user.password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const mockUserWithPassword = { ...mockUser, password: 'hashedPassword' };
      userRepository.findOne.mockResolvedValue(mockUserWithPassword as User);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        'hashedPassword',
      );
    });
  });

  describe('validateUser', () => {
    const payload = { sub: 'test-id', email: 'test@example.com' };

    it('should return user if found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.validateUser(payload);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.validateUser(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
