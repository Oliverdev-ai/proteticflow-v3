import { useState } from 'react';
import { trpc } from '../../lib/trpc';

export function ProfileForm() {
  const profile = trpc.auth.getProfile.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.getProfile.invalidate();
    },
  });

  const changePassword = trpc.auth.changePassword.useMutation();

  const onSaveProfile = () => {
    updateProfile.mutate({
      name: name || profile.data?.name,
      phone: phone || profile.data?.phone || undefined,
    });
  };

  const onChangePassword = () => {
    changePassword.mutate({ currentPassword, newPassword });
    setCurrentPassword('');
    setNewPassword('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-semibold">Meu perfil</h3>
        <p className="text-neutral-400 text-sm">Atualize nome e telefone usando o dominio de auth.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder={profile.data?.name ?? 'Nome'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder={profile.data?.phone ?? 'Telefone'}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <button onClick={onSaveProfile} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm">
        Salvar perfil
      </button>

      <div className="border-t border-neutral-800 pt-4 space-y-3">
        <h4 className="text-white font-medium">Trocar senha</h4>
        <input
          type="password"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Senha atual"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Nova senha"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button onClick={onChangePassword} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg text-sm">
          Atualizar senha
        </button>
      </div>
    </div>
  );
}
