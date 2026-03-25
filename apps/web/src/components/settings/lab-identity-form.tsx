import { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/use-settings';

export function LabIdentityForm() {
  const { overview, updateIdentity } = useSettings();
  const identity = overview.data?.identity;

  const [name, setName] = useState(identity?.name ?? '');
  const [cnpj, setCnpj] = useState(identity?.cnpj ?? '');
  const [email, setEmail] = useState(identity?.email ?? '');
  const [phone, setPhone] = useState(identity?.phone ?? '');
  const [address, setAddress] = useState(identity?.address ?? '');
  const [city, setCity] = useState(identity?.city ?? '');
  const [state, setState] = useState(identity?.state ?? '');
  const [website, setWebsite] = useState(identity?.website ?? '');

  useEffect(() => {
    if (!identity) return;
    setName(identity.name ?? '');
    setCnpj(identity.cnpj ?? '');
    setEmail(identity.email ?? '');
    setPhone(identity.phone ?? '');
    setAddress(identity.address ?? '');
    setCity(identity.city ?? '');
    setState(identity.state ?? '');
    setWebsite(identity.website ?? '');
  }, [identity]);

  return (
    <div className="space-y-3">
      <h4 className="text-white font-medium">Identidade do laboratorio</h4>
      <div className="grid md:grid-cols-2 gap-3">
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="UF" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
      </div>
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Endereco" value={address} onChange={(e) => setAddress(e.target.value)} />
      <input className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button
        onClick={() => updateIdentity.mutate({ name, cnpj, email, phone, address, city, state, website })}
        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
      >
        Salvar identidade
      </button>
    </div>
  );
}
