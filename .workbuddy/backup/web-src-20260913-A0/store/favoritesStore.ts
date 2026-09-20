/**
 * 收藏 store — 本地持久化（localStorage），无需后端。
 * 存储精简后的模板信息，供「我的收藏」页与模板卡爱心切换共用。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteTemplate {
  id: string;
  name: string;
  cover: string | null;
  price: number;
  currency: string;
  category: string;
}

interface FavoritesState {
  items: FavoriteTemplate[];
  toggle: (t: FavoriteTemplate) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (t) => {
        const exists = get().items.some((i) => i.id === t.id);
        set({ items: exists ? get().items.filter((i) => i.id !== t.id) : [t, ...get().items] });
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      has: (id) => get().items.some((i) => i.id === id),
    }),
    { name: 'h5_favorites' },
  ),
);
