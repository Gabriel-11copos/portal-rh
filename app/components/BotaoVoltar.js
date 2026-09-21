'use client';
import { useRouter } from 'next/navigation';

export default function BotaoVoltar() {
  const router = useRouter();
  return (
    <button className="secundario" onClick={() => router.back()} style={{ marginBottom: 16 }}>
      ← Voltar
    </button>
  );
}
