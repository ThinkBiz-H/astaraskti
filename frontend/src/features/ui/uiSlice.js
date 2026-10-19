import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    isCartOpen: false,
    isMobileMenuOpen: false,
    isSearchOpen: false,
  },
  reducers: {
    openCart: (state) => { state.isCartOpen = true; },
    closeCart: (state) => { state.isCartOpen = false; },
    toggleMobileMenu: (state) => { state.isMobileMenuOpen = !state.isMobileMenuOpen; },
    closeMobileMenu: (state) => { state.isMobileMenuOpen = false; },
    toggleSearch: (state) => { state.isSearchOpen = !state.isSearchOpen; },
    closeSearch: (state) => { state.isSearchOpen = false; },
  },
});

export const { openCart, closeCart, toggleMobileMenu, closeMobileMenu, toggleSearch, closeSearch } = uiSlice.actions;
export default uiSlice.reducer;
