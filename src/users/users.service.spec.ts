/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UpdateProfileDto } from '../dto/auth.dto';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockUser: Partial<User> = {
    id: 'user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsers: Partial<User>[] = [
    mockUser,
    {
      id: 'user-id-2',
      email: 'test2@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const mockUserRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of users without passwords', async () => {
      userRepository.find.mockResolvedValue(mockUsers as User[]);

      const result = await service.findAll();

      expect(userRepository.find).toHaveBeenCalledWith({
        select: [
          'id',
          'email',
          'firstName',
          'lastName',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should return a user by id without password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findOne('user-id');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: [
          'id',
          'email',
          'firstName',
          'lastName',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        select: [
          'id',
          'email',
          'firstName',
          'lastName',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
      });
    });
  });

  describe('updateProfile', () => {
    const updateProfileDto: UpdateProfileDto = {
      firstName: 'UpdatedJohn',
      lastName: 'UpdatedDoe',
    };

    it('should successfully update user profile', async () => {
      const updatedUser = { ...mockUser, ...updateProfileDto };

      userRepository.findOne.mockResolvedValue(mockUser as User);
      userRepository.save.mockResolvedValue(updatedUser as User);

      const result = await service.updateProfile('user-id', updateProfileDto);

      expect(userRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        ...updateProfileDto,
      });
      expect(result).toEqual(updatedUser);
      expect(result.password).toBeUndefined();
    });

    it('should throw NotFoundException if user not found during update', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', updateProfileDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should successfully remove a user', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      userRepository.remove.mockResolvedValue(mockUser as User);

      await service.remove('user-id');

      expect(userRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found during removal', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
