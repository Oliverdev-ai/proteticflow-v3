export const AI_TOOLS = [
  {
    name: 'create_job',
    description: 'Cria uma nova ordem de serviço no laboratório',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientName: { type: 'string', description: 'Nome do dentista/cliente' },
        osNumber: { type: 'number', description: 'Número da OS física (opcional)' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serviceName: { type: 'string', description: 'Nome do serviço (ex: coroa, ponte)' },
              quantity: { type: 'number', description: 'Quantidade' },
              color: { type: 'string', description: 'Cor/shade (ex: A2, B1)' },
            },
            required: ['serviceName'],
          },
        },
        deadline: { type: 'string', description: 'Data de entrega (ISO ou "sexta", "próxima segunda")' },
        notes: { type: 'string', description: 'Instruções especiais' },
      },
      required: ['clientName'],
    },
  },
];
