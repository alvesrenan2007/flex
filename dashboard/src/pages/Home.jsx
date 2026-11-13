import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { professorsApi } from '../api/professors';
import { roomsApi, teacherRoomSocket } from '../api/rooms';

const EMPTY_ROOM_FORM = { name: '', capacity: '30', presetId: '', whitelist: '' };
const EMPTY_PRESET_FORM = { name: '', urls: '' };

function collectionFrom(data, key, label) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  throw new Error(`A resposta da API não contém a lista de ${label}.`);
}

function parseDomains(value) {
  return value.split(/[\n,]/).map((domain) => domain.trim()).filter(Boolean);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

export default function Home() {
  const { professor, token, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('rooms');
  const [rooms, setRooms] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM_FORM);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [whitelistForm, setWhitelistForm] = useState({ presetId: '' });
  const [savingWhitelist, setSavingWhitelist] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]);
  const [presetForm, setPresetForm] = useState(EMPTY_PRESET_FORM);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const participantSnapshot = useRef({ roomId: '', names: new Set() });
  const auditSequence = useRef(0);

  const loadRooms = useCallback(async () => {
    const data = await roomsApi.list(token);
    const items = collectionFrom(data, 'rooms', 'salas');
    setRooms(items);
    setSelectedRoomId((current) => items.some((room) => String(room.id) === String(current))
      ? current
      : String(items[0]?.id || ''));
    return items;
  }, [token]);

  const loadPresets = useCallback(async () => {
    const data = await roomsApi.listPresets(token);
    setPresets(collectionFrom(data, 'presets', 'presets'));
  }, [token]);

  useEffect(() => {
    let active = true;
    setLoadingRooms(true);
    Promise.all([loadRooms(), loadPresets()])
      .catch((loadError) => { if (active) setError(loadError.message || 'Não foi possível carregar os dados.'); })
      .finally(() => { if (active) setLoadingRooms(false); });
    return () => { active = false; };
  }, [loadRooms, loadPresets]);

  useEffect(() => {
    if (section !== 'rooms' || !selectedRoomId) {
      setSelectedRoom(null);
      setParticipants([]);
      return undefined;
    }

    let active = true;
    const refreshParticipants = async () => {
      try {
        const data = await roomsApi.participants(selectedRoomId, token);
        const room = data?.room ?? data;
        if (!active) return;
        const names = new Set((Array.isArray(room?.participants) ? room.participants : []).map((participant) => participant.nickname));
        if (participantSnapshot.current.roomId === String(room.id)) {
          names.forEach((name) => {
            if (!participantSnapshot.current.names.has(name)) recordAudit(`${name} entrou na sala.`);
          });
          participantSnapshot.current.names.forEach((name) => {
            if (!names.has(name)) recordAudit(`${name} saiu da sala.`);
          });
        }
        participantSnapshot.current = { roomId: String(room.id), names };
        setSelectedRoom(room);
        setParticipants(Array.isArray(room?.participants) ? room.participants : []);
        setRooms((current) => current.map((item) => String(item.id) === String(room.id)
          ? { ...item, ...room }
          : item));
        setError('');
      } catch (loadError) {
        if (active) setError(loadError.message || 'Não foi possível carregar os participantes.');
      } finally {
        if (active) setLoadingParticipants(false);
      }
    };

    setLoadingParticipants(true);
    refreshParticipants();
    const intervalId = window.setInterval(refreshParticipants, 8000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [section, selectedRoomId, token]);

  useEffect(() => {
    setProfileForm({ name: professor?.name || '', email: professor?.email || '', password: '' });
  }, [professor]);

  useEffect(() => {
    setWhitelistForm({ presetId: selectedRoom?.presetId ? String(selectedRoom.presetId) : '' });
  }, [selectedRoom?.id, selectedRoom?.presetId]);

  function showNotice(message) {
    setError('');
    setNotice(message);
  }

  function recordAudit(message, tone = 'normal') {
    auditSequence.current += 1;
    setAuditEntries((entries) => [{ id: auditSequence.current, message, tone, createdAt: new Date() }, ...entries].slice(0, 20));
  }

  async function handleCreateRoom(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setCreatingRoom(true);
    try {
      const payload = {
        name: roomForm.name.trim(),
        capacity: Number(roomForm.capacity),
      };
      if (roomForm.presetId) payload.presetId = Number(roomForm.presetId);
      else payload.whitelist = parseDomains(roomForm.whitelist);

      const result = await teacherRoomSocket.create(payload, token);
      const room = result.room;
      if (!room?.id && !result.roomId) throw new Error('A API não retornou o identificador da sala criada.');
      const roomId = String(room?.id || result.roomId);
      setRoomForm(EMPTY_ROOM_FORM);
      setShowCreateRoom(false);
      setSelectedRoomId(roomId);
      await loadRooms();
      setSelectedRoomId(roomId);
      showNotice(`Sala “${room?.name || payload.name}” criada. Código: ${roomId}`);
      recordAudit(`Sala criada: ${room?.name || payload.name} (${roomId}).`);
    } catch (createError) {
      setError(createError.message || 'Não foi possível criar a sala.');
    } finally {
      setCreatingRoom(false);
    }
  }

  async function saveWhitelist(payload, successMessage) {
    if (!selectedRoom) return false;
    setError('');
    setNotice('');
    setSavingWhitelist(true);
    try {
      const result = await teacherRoomSocket.updateWhitelist(payload, token);
      const updatedRoom = result.room;
      if (!updatedRoom) throw new Error('A API não retornou os dados atualizados da sala.');
      setSelectedRoom(updatedRoom);
      setRooms((current) => current.map((room) => String(room.id) === String(updatedRoom.id)
        ? { ...room, ...updatedRoom }
        : room));
      showNotice(successMessage);
      recordAudit(`Whitelist atualizada na sala ${selectedRoom.id}.`);
      return true;
    } catch (updateError) {
      setError(updateError.message || 'Não foi possível atualizar a whitelist.');
      recordAudit(`Falha ao atualizar a whitelist: ${updateError.message || 'erro da API'}.`, 'alert');
      return false;
    } finally {
      setSavingWhitelist(false);
    }
  }

  async function handleToggleDomain(domain, allowed) {
    const currentDomains = Array.isArray(selectedRoom?.whitelist) ? selectedRoom.whitelist : [];
    const whitelist = allowed
      ? [...currentDomains, domain]
      : currentDomains.filter((item) => item !== domain);
    await saveWhitelist({ roomId: selectedRoom.id, whitelist }, 'Whitelist atualizada.');
  }

  async function handleAddDomain(event) {
    event.preventDefault();
    const domains = parseDomains(newDomain);
    if (domains.length !== 1) {
      setError('Informe um domínio por vez.');
      return;
    }
    const currentDomains = Array.isArray(selectedRoom?.whitelist) ? selectedRoom.whitelist : [];
    if (currentDomains.includes(domains[0])) {
      setError('Esse domínio já está na whitelist.');
      return;
    }
    if (await saveWhitelist({ roomId: selectedRoom.id, whitelist: [...currentDomains, domains[0]] }, 'Domínio adicionado à whitelist.')) {
      setNewDomain('');
    }
  }

  async function handleApplyPreset() {
    if (!whitelistForm.presetId) {
      setError('Selecione um preset.');
      return;
    }
    await saveWhitelist({ roomId: selectedRoom.id, presetId: Number(whitelistForm.presetId) }, 'Preset aplicado à sala.');
  }

  async function copyRoomCode() {
    if (!selectedRoom?.id) return;
    try {
      await navigator.clipboard.writeText(String(selectedRoom.id));
      showNotice('Código da sala copiado.');
    } catch (copyError) {
      setError(copyError.message || 'Não foi possível copiar o código da sala.');
    }
  }

  async function handleCloseRoom() {
    if (!selectedRoom || !window.confirm(`Fechar a sala “${selectedRoom.name}” (${selectedRoom.id})? Os participantes serão removidos e não poderão continuar nela.`)) return;

    setError('');
    setNotice('');
    setClosingRoom(true);
    const closedRoom = selectedRoom;
    try {
      await teacherRoomSocket.close({ roomId: closedRoom.id }, token);
      const remainingRooms = rooms.filter((room) => String(room.id) !== String(closedRoom.id));
      setRooms(remainingRooms);
      setSelectedRoomId(String(remainingRooms[0]?.id || ''));
      setSelectedRoom(null);
      setParticipants([]);
      participantSnapshot.current = { roomId: '', names: new Set() };
      setShowCreateRoom(false);
      showNotice(`Sala ${closedRoom.id} encerrada.`);
      recordAudit(`Sala encerrada: ${closedRoom.name} (${closedRoom.id}).`);
    } catch (closeError) {
      setError(closeError.message || 'Não foi possível fechar a sala.');
      recordAudit(`Falha ao fechar a sala ${closedRoom.id}: ${closeError.message || 'erro da API'}.`, 'alert');
    } finally {
      setClosingRoom(false);
    }
  }

  function startEditingPreset(preset) {
    setEditingPresetId(preset.id);
    setPresetForm({ name: preset.name || '', urls: Array.isArray(preset.urls) ? preset.urls.join('\n') : '' });
    setError('');
    setNotice('');
  }

  function cancelEditingPreset() {
    setEditingPresetId(null);
    setPresetForm(EMPTY_PRESET_FORM);
  }

  async function handleSavePreset(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingPreset(true);
    try {
      const fields = { name: presetForm.name.trim(), urls: parseDomains(presetForm.urls) };
      if (editingPresetId === null) {
        await roomsApi.createPreset(fields, token);
        showNotice('Preset criado.');
      } else {
        await roomsApi.updatePreset(editingPresetId, fields, token);
        showNotice('Preset atualizado.');
      }
      cancelEditingPreset();
      await loadPresets();
    } catch (saveError) {
      setError(saveError.message || 'Não foi possível salvar o preset.');
    } finally {
      setSavingPreset(false);
    }
  }

  async function handleDeletePreset(preset) {
    if (!window.confirm(`Excluir o preset “${preset.name}”?`)) return;
    setError('');
    setNotice('');
    try {
      await roomsApi.removePreset(preset.id, token);
      if (String(editingPresetId) === String(preset.id)) cancelEditingPreset();
      await loadPresets();
      showNotice('Preset removido.');
    } catch (deleteError) {
      setError(deleteError.message || 'Não foi possível remover o preset.');
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingProfile(true);
    try {
      const fields = { name: profileForm.name.trim(), email: profileForm.email.trim() };
      if (profileForm.password) fields.password = profileForm.password;
      await professorsApi.update(professor.id, fields, token);
      await refreshProfile();
      setProfileForm((current) => ({ ...current, password: '' }));
      showNotice('Perfil atualizado.');
    } catch (saveError) {
      setError(saveError.message || 'Não foi possível atualizar o perfil.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Excluir sua conta de professor? Esta ação não pode ser desfeita.')) return;
    setError('');
    try {
      await professorsApi.remove(professor.id, token);
      logout();
      navigate('/login', { replace: true });
    } catch (deleteError) {
      setError(deleteError.message || 'Não foi possível excluir a conta.');
    }
  }

  const sectionTitle = section === 'rooms' ? 'DASHBOARD' : section === 'presets' ? 'PRESETS' : 'INSTRUTOR';

  return (
    <section className="teacher-dashboard" aria-labelledby="dashboard-title">
      <div className={`dashboard-overview ${section === 'rooms' ? '' : 'secondary-section'}`}>
        <h1 id="dashboard-title">{sectionTitle}</h1>
        {section === 'rooms' && (
          <div className="classroom-bar">
            {rooms.length > 1 && (
              <div className="room-picker">
                <label htmlFor="active-room">Sala</label>
                <select id="active-room" value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </div>
            )}
            <div className="classroom-code">
              <label htmlFor="classroom-code">Classroom Code</label>
              <input id="classroom-code" readOnly value={selectedRoom?.id || ''} placeholder={loadingRooms ? 'Carregando...' : 'Crie uma sala para gerar o código'} />
            </div>
            <button type="button" className="primary-button copy-button" disabled={!selectedRoom?.id} onClick={copyRoomCode}>Copy</button>
          </div>
        )}
        <nav className="dashboard-actions" aria-label="Seções do professor">
          {section !== 'rooms' && <button type="button" onClick={() => { setSection('rooms'); setError(''); setNotice(''); }}>Dashboard</button>}
          <button type="button" className={section === 'presets' ? 'active' : ''} onClick={() => { setSection('presets'); setError(''); setNotice(''); }}>Presets</button>
          <button type="button" className={section === 'profile' ? 'active' : ''} onClick={() => { setSection('profile'); setError(''); setNotice(''); }}>Perfil</button>
          {section === 'rooms' && selectedRoom && <button type="button" className="danger-button close-room-button" disabled={closingRoom} onClick={handleCloseRoom}>{closingRoom ? 'Fechando...' : 'Fechar sala'}</button>}
          {section === 'rooms' && <button type="button" className="primary-button new-room-button" onClick={() => setShowCreateRoom((visible) => !visible)}>{showCreateRoom ? 'Cancelar' : '+ Nova sala'}</button>}
        </nav>
      </div>

      {error && <p className="notice error dashboard-notice" role="alert">{error}</p>}
      {notice && <p className="notice success dashboard-notice" role="status">{notice}</p>}

      {section === 'rooms' && (
        <>
          <div className="dashboard-main-grid">
            <section className="panel whitelist-panel">
              <div className="panel-heading">
                <div>
                  <h2>Whitelist</h2>
                  <p>Default-deny: tudo fora da lista é bloqueado.</p>
                </div>
              </div>
              {selectedRoom ? (
                <>
                  <div className="whitelist-preset-row">
                    <label className="sr-only" htmlFor="room-preset">Preset da whitelist</label>
                    <select id="room-preset" value={whitelistForm.presetId} onChange={(event) => setWhitelistForm({ presetId: event.target.value })}>
                      <option value="">Lista personalizada</option>
                      {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                    </select>
                    <button type="button" className="primary-button compact-button" disabled={savingWhitelist || !whitelistForm.presetId} onClick={handleApplyPreset}>Aplicar</button>
                  </div>
                  <div className="whitelist-list">
                    {(selectedRoom.whitelist || []).map((domain) => (
                      <label className="whitelist-row" key={domain}>
                        <span>{domain}</span>
                        <input
                          className="whitelist-toggle"
                          type="checkbox"
                          checked
                          disabled={savingWhitelist}
                          onChange={(event) => handleToggleDomain(domain, event.target.checked)}
                          aria-label={`Permitir ${domain}`}
                        />
                      </label>
                    ))}
                    {(selectedRoom.whitelist || []).length === 0 && <p className="empty-state compact">Nenhum domínio permitido.</p>}
                  </div>
                  <form className="add-domain-form" onSubmit={handleAddDomain}>
                    <label className="sr-only" htmlFor="new-domain">Novo domínio</label>
                    <input id="new-domain" value={newDomain} onChange={(event) => setNewDomain(event.target.value)} placeholder="novo-dominio.com" />
                    <button className="primary-button compact-button" type="submit" disabled={savingWhitelist || !newDomain.trim()}>{savingWhitelist ? '...' : 'Add'}</button>
                  </form>
                </>
              ) : (
                <p className="empty-state">{loadingRooms ? 'Carregando sala...' : 'Crie ou selecione uma sala para editar a whitelist.'}</p>
              )}
            </section>

            <section className="panel students-panel">
              <div className="panel-heading"><h2>Students Connected ({participants.length})</h2></div>
              {!selectedRoom ? (
                <p className="empty-state">Os participantes aparecerão quando uma sala estiver ativa.</p>
              ) : loadingParticipants && participants.length === 0 ? (
                <p className="empty-state">Carregando participantes...</p>
              ) : participants.length === 0 ? (
                <p className="empty-state">Nenhum participante conectado.</p>
              ) : (
                <ul className="student-list">
                  {participants.map((participant, index) => (
                    <li className="student-row" key={`${participant.nickname}-${participant.connectedAt || index}`}>
                      <span>{participant.nickname}</span>
                      <span className="student-status" title={`Conectado em ${formatDate(participant.connectedAt)}`}>Online</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="panel audit-panel">
            <div className="panel-heading">
              <div><h2>Audit Log</h2><p>Atividade observada nesta sessão.</p></div>
            </div>
            {auditEntries.length === 0 ? <p className="empty-state">Nenhuma atividade registrada ainda.</p> : (
              <ul className="audit-list">
                {auditEntries.map((entry) => (
                  <li className={`audit-entry ${entry.tone === 'alert' ? 'alert' : ''}`} key={entry.id}>
                    <span>{entry.message}</span>
                    <time>{formatDate(entry.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(showCreateRoom || (!loadingRooms && rooms.length === 0)) && (
            <section className="panel create-room-panel">
              <h2>Criar sala</h2>
              <p className="panel-description">Compartilhe o código com seus participantes.</p>
              <form className="form-stack" onSubmit={handleCreateRoom}>
                <label htmlFor="new-room-name">Nome da sala</label>
                <input id="new-room-name" value={roomForm.name} onChange={(event) => setRoomForm((current) => ({ ...current, name: event.target.value }))} maxLength="80" required placeholder="Ex.: Aula de matemática" />
                <label htmlFor="room-capacity">Capacidade</label>
                <input id="room-capacity" type="number" min="1" step="1" value={roomForm.capacity} onChange={(event) => setRoomForm((current) => ({ ...current, capacity: event.target.value }))} required />
                <label htmlFor="new-room-preset">Whitelist</label>
                <select id="new-room-preset" value={roomForm.presetId} onChange={(event) => setRoomForm((current) => ({ ...current, presetId: event.target.value }))}>
                  <option value="">Usar lista própria</option>
                  {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
                {!roomForm.presetId && (
                  <>
                    <label htmlFor="new-room-whitelist">Domínios permitidos</label>
                    <textarea id="new-room-whitelist" rows="3" placeholder={'google.com\ndocs.example.org'} value={roomForm.whitelist} onChange={(event) => setRoomForm((current) => ({ ...current, whitelist: event.target.value }))} />
                    <small className="field-hint">Um domínio por linha, sem protocolo, caminho ou porta.</small>
                  </>
                )}
                <button className="primary-button" type="submit" disabled={creatingRoom}>{creatingRoom ? 'Criando sala...' : 'Criar sala'}</button>
              </form>
            </section>
          )}
        </>
      )}

      {section === 'presets' && (
        <div className="dashboard-grid presets-grid">
          <section className="panel">
            <div className="panel-heading"><div><h2>Seus presets</h2><p>Reutilize listas de domínios em novas salas.</p></div></div>
            {presets.length === 0 ? <p className="empty-state">Nenhum preset cadastrado.</p> : (
              <div className="preset-list">
                {presets.map((preset) => (
                  <article className="preset-item" key={preset.id}>
                    <div><h3>{preset.name}</h3><p>{Array.isArray(preset.urls) ? preset.urls.join(' · ') : ''}</p></div>
                    <div className="item-actions">
                      <button type="button" className="text-button" onClick={() => startEditingPreset(preset)}>Editar</button>
                      <button type="button" className="text-button danger-text" onClick={() => handleDeletePreset(preset)}>Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>{editingPresetId === null ? 'Criar preset' : 'Editar preset'}</h2>
            <p className="panel-description">Até 100 domínios por preset. A API normaliza e remove duplicatas.</p>
            <form className="form-stack" onSubmit={handleSavePreset}>
              <label htmlFor="preset-name">Nome</label>
              <input id="preset-name" value={presetForm.name} onChange={(event) => setPresetForm((current) => ({ ...current, name: event.target.value }))} maxLength="80" required />
              <label htmlFor="preset-domains">Domínios permitidos</label>
              <textarea id="preset-domains" rows="8" placeholder={'google.com\ndocs.example.org'} value={presetForm.urls} onChange={(event) => setPresetForm((current) => ({ ...current, urls: event.target.value }))} />
              <small className="field-hint">Um domínio por linha, sem protocolo, caminho ou porta.</small>
              <button className="primary-button" type="submit" disabled={savingPreset}>{savingPreset ? 'Salvando...' : editingPresetId === null ? 'Criar preset' : 'Salvar alterações'}</button>
              {editingPresetId !== null && <button className="secondary-button" type="button" onClick={cancelEditingPreset}>Cancelar edição</button>}
            </form>
          </section>
        </div>
      )}

      {section === 'profile' && (
        <div className="profile-layout">
          <section className="panel profile-panel">
            <h2>Meu perfil</h2>
            <p className="panel-description">Atualize seus dados de acesso. Deixe a senha vazia para mantê-la.</p>
            <form className="form-stack" onSubmit={handleSaveProfile}>
              <label htmlFor="profile-name">Nome</label>
              <input id="profile-name" autoComplete="name" maxLength="100" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} required />
              <label htmlFor="profile-email">E-mail</label>
              <input id="profile-email" type="email" autoComplete="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} required />
              <label htmlFor="profile-password">Nova senha</label>
              <input id="profile-password" type="password" autoComplete="new-password" value={profileForm.password} onChange={(event) => setProfileForm((current) => ({ ...current, password: event.target.value }))} />
              <button className="primary-button" type="submit" disabled={savingProfile}>{savingProfile ? 'Salvando...' : 'Salvar perfil'}</button>
            </form>
          </section>
          <section className="panel account-danger-panel">
            <h2>Excluir conta</h2>
            <p>A exclusão da conta é permanente e não pode ser desfeita.</p>
            <button type="button" className="danger-button" onClick={handleDeleteAccount}>Excluir minha conta</button>
          </section>
        </div>
      )}
    </section>
  );
}
