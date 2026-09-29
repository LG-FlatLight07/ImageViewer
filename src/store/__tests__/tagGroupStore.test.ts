import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTagGroupStore } from '../tagGroupStore';
jest.mock('expo-crypto', () => {
  let next = 0;
  return { randomUUID: () => `group-${++next}` };
});

beforeEach(() => useTagGroupStore.setState({ groups: [] }));
it('creates named categories and moves tags between them without losing other tags', () => {
  const store = useTagGroupStore.getState();
  const a = store.save(null, ' 作者 ', ['A', 'B', 'A']);
  const b = store.save(null, '二次創作', ['C']);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  store.save(b, '年代', ['B', 'C']);
  expect(useTagGroupStore.getState().groups.map((g) => [g.name, g.tags])).toEqual([
    ['作者', ['A']],
    ['年代', ['B', 'C']],
  ]);
  expect(store.save(null, '作者', [])).toBeNull();
  expect(store.save(null, ' ', [])).toBeNull();
  expect(store.save(null, 'すべて', [])).toBeNull();
});
it('restores groups and membership after restarting', async () => {
  useTagGroupStore.getState().save(null, '作者', ['A']);
  const saved = await AsyncStorage.getItem('gallery-tag-groups');
  useTagGroupStore.setState({ groups: [] });
  await AsyncStorage.setItem('gallery-tag-groups', saved!);
  await useTagGroupStore.persist.rehydrate();
  expect(useTagGroupStore.getState().groups[0]).toMatchObject({ name: '作者', tags: ['A'] });
  useTagGroupStore.getState().remove(useTagGroupStore.getState().groups[0].id);
  expect(useTagGroupStore.getState().groups).toEqual([]);
});
