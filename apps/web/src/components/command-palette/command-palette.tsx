import { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { CommandGroups } from './command-groups';
import { CommandSearchResults } from './command-search';
import { useCommandPalette } from './use-command-palette';

export function CommandPalette() {
  const { open, setOpen, closePalette } = useCommandPalette();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery('');
  }, [setOpen]);

  const handleSelect = useCallback(() => {
    closePalette();
    setQuery('');
  }, [closePalette]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Paleta de comandos"
      overlayClassName="fixed inset-0 z-[80] bg-black/55"
      contentClassName="fixed left-1/2 top-[12vh] z-[81] w-[min(560px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0 shadow-[var(--shadow-lg)]"
    >
      <Command
        loop
        className="flex max-h-[70vh] flex-col overflow-hidden bg-[var(--bg-elevated)] [&_[cmdk-group-heading]]:t-small [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[var(--fg-muted)]"
      >
        <div className="border-b border-[var(--border)] px-3 py-2">
          <Command.Input
            value={query}
            onValueChange={setQuery}
            autoFocus
            placeholder="Buscar ou navegar..."
            className="h-9 w-full bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)]"
          />
        </div>

        <Command.List className="max-h-[58vh] overflow-y-auto p-2">
          <Command.Empty className="px-2 py-3 t-small text-[var(--fg-muted)]">
            Nenhum resultado.
          </Command.Empty>
          <CommandGroups onSelect={handleSelect} />
          <CommandSearchResults query={query} onSelect={handleSelect} />
        </Command.List>
      </Command>
    </Command.Dialog>
  );
}
