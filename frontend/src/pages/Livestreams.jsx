import React, { useEffect, useState } from 'react';
import livestreamApi from '../utils/livestreamApi';
import { useAuth } from '../hooks/useAuth';

export default function Livestreams() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    livestreamApi.listActive().then(res => {
      if (mounted) setStreams(res || []);
    }).catch(() => {}).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const payload = { title: title.trim(), embedUrl: embedUrl.trim() };
      const created = await livestreamApi.create(payload);
      setStreams((s) => [created, ...s]);
      setTitle(''); setEmbedUrl('');
    } catch (err) {
      console.error('Create livestream error', err);
      alert('Không thể tạo livestream: ' + (err?.message || ''));
    }
  }

  return (
    <div className="livestreams-page">
      <h2>Livestreams</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h3>Tạo Livestream</h3>
          {user ? (
            <form onSubmit={handleCreate}>
              <div>
                <label>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label>Embed URL (YouTube/StreamYard...)</label>
                <input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} />
              </div>
              <button type="submit">Start Livestream</button>
            </form>
          ) : (
            <div>Vui lòng đăng nhập để tạo livestream</div>
          )}
        </div>

        <div style={{ flex: 2 }}>
          <h3>Active Streams</h3>
          {loading ? <div>Đang tải...</div> : (
            streams.length === 0 ? <div>Không có livestream nào đang diễn ra</div> : (
              <ul>
                {streams.map(s => (
                  <li key={s.LivestreamID} style={{ marginBottom: 16 }}>
                    <strong>{s.Title || 'Untitled'}</strong>
                    <div>by: {s.AccountID}</div>
                    {s.EmbedUrl ? (
                      <div style={{ marginTop: 8 }}>
                        <iframe title={`ls-${s.LivestreamID}`} src={s.EmbedUrl} width="560" height="315" frameBorder="0" allowFullScreen />
                      </div>
                    ) : <div>No embed</div>}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}
