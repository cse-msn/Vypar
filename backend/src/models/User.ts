import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, type Role } from '../constants';
import { env } from '../config/env';
import { applyToJSON } from '../utils/toJSON';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

interface UserModel extends Model<IUser, {}, IUserMethods> {
  hashPassword(plain: string): Promise<string>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'staff' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

applyToJSON(userSchema, ['passwordHash']);

userSchema.method('comparePassword', function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
});

userSchema.static('hashPassword', function (plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
});

export const User = model<IUser, UserModel>('User', userSchema);
