import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getAvatarUrl, getMeuPerfil } from '../features/perfil/api';
import { useAuth } from '../features/auth/AuthProvider';
import { colors, radius, type } from '../constants/theme';

type Props = {
  size?: number;
  onPress?: () => void;
};

export function AvatarPerfil({ size = 42, onPress }: Props) {
  const { session } = useAuth();
  const [nome, setNome] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!session?.user.id) {
      setNome('');
      setAvatarPath(null);
      return () => {
        vigente = false;
      };
    }

    getMeuPerfil(session.user.id)
      .then((perfil) => {
        if (!vigente) return;
        setNome(perfil.nome);
        setAvatarPath(perfil.avatar_path);
      })
      .catch((erro) => console.error(erro));

    return () => {
      vigente = false;
    };
  }, [session?.user.id]);

  const url = getAvatarUrl(avatarPath);
  const inicial = (nome || session?.user.email || '?').charAt(0).toUpperCase();
  const conteudo = url ? <Image source={{ uri: url }} style={styles.imagem} /> : <Text style={styles.texto}>{inicial}</Text>;

  if (!onPress) {
    return <View style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}>{conteudo}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
      onPress={onPress}
      accessibilityLabel="Abrir meu perfil"
    >
      {conteudo}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagem: {
    width: '100%',
    height: '100%',
  },
  texto: {
    color: colors.primary,
    fontFamily: type.title.fontFamily,
    fontSize: 18,
  },
});
