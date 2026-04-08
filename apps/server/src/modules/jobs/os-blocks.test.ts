import { Mock, describe, it, expect, beforeEach, vi } from 'vitest';
import { createOsBlock, resolveClientByOsNumber } from './os-blocks.service.js';
import { db } from '../../db/index.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    innerJoin: vi.fn(),
  }
}));

describe('OS Blocks Service', () => {
  const tenantId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOsBlock', () => {
    it('should throw error if block overlaps existing one', async () => {
      // Mock conflicting block
      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 10 }])
        })
      });

      await expect(createOsBlock(tenantId, {
        clientId: 1,
        startNumber: 100,
        endNumber: 200,
        label: 'Teste'
      })).rejects.toThrow('O intervalo do bloco sobrepõe um bloco existente');
    });

    it('should create block if no overlap', async () => {
      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      (db.insert as Mock).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, startNumber: 100, endNumber: 200 }])
        })
      });

      const result = await createOsBlock(tenantId, {
        clientId: 1,
        startNumber: 100,
        endNumber: 200
      });

      expect(result!.id).toBe(1);
    });
  });

  describe('resolveClientByOsNumber', () => {
    it('should return client if OS number is within range', async () => {
      const mockResult = [{
        os_blocks: { id: 1 },
        clients: { id: 5, name: 'Dr. Teste' }
      }];

      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockResult)
          })
        })
      });

      const result = await resolveClientByOsNumber(tenantId, 150);
      expect(result?.clientId).toBe(5);
      expect(result?.clientName).toBe('Dr. Teste');
    });

    it('should return null if no block found', async () => {
      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await resolveClientByOsNumber(tenantId, 9999);
      expect(result).toBeNull();
    });
  });
});
