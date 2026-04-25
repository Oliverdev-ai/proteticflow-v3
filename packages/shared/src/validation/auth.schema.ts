import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve ter pelo menos 1 letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter pelo menos 1 número'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(), // 2FA se habilitado
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().max(32).optional(),
  aiVoiceEnabled: z.boolean().optional(),
  aiVoiceGender: z.enum(['female', 'male']).optional(),
  aiVoiceSpeed: z.number().min(0.25).max(4).optional(),
  // avatarUrl será setado via upload, não via este schema
});

export const setup2faSchema = z.object({
  totpCode: z.string().length(6),
});

export const verify2faSchema = z.object({
  totpCode: z.string().length(6),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['superadmin', 'gerente', 'producao', 'recepcao', 'contabil']),
});
