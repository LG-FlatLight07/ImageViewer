import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContentsFilterStore } from '../contentsFilterStore';

beforeEach(() => useContentsFilterStore.setState({ filters: [], defaultFilter: '' }));

it('saves trimmed conditions without duplicates', () => {
  useContentsFilterStore.getState().save(' HOGEHOGE ');
  useContentsFilterStore.getState().save('HOGEHOGE');
  useContentsFilterStore.getState().save(' ');
  expect(useContentsFilterStore.getState().filters).toEqual(['HOGEHOGE']);
});

it('saves a default and resets it when the condition is removed', () => {
  useContentsFilterStore.getState().setDefault('HOGEHOGE');
  expect(useContentsFilterStore.getState().filters).toEqual(['HOGEHOGE']);
  expect(useContentsFilterStore.getState().defaultFilter).toBe('HOGEHOGE');
  useContentsFilterStore.getState().remove('HOGEHOGE');
  expect(useContentsFilterStore.getState().defaultFilter).toBe('');
});

it('can make all images the default without deleting saved conditions', () => {
  useContentsFilterStore.getState().setDefault('396_desktop_medium_2x');
  useContentsFilterStore.getState().setDefault('');
  expect(useContentsFilterStore.getState().defaultFilter).toBe('');
  expect(useContentsFilterStore.getState().filters).toEqual(['396_desktop_medium_2x']);
});

it('restores saved conditions and the default from persistent storage', async () => {
  useContentsFilterStore.getState().setDefault('HOGEHOGE');
  useContentsFilterStore.getState().save('396_desktop_medium_2x');
  const saved = await AsyncStorage.getItem('contents-filter-store');
  useContentsFilterStore.setState({ filters: [], defaultFilter: '' });
  await AsyncStorage.setItem('contents-filter-store', saved!);
  await useContentsFilterStore.persist.rehydrate();
  expect(useContentsFilterStore.getState().filters).toEqual(['HOGEHOGE', '396_desktop_medium_2x']);
  expect(useContentsFilterStore.getState().defaultFilter).toBe('HOGEHOGE');
});
