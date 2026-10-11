import '@fontsource-variable/nunito';
import './app/global.css';
import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app')!;

// `?art` opens a gallery of all procedural artwork (development helper)
if (new URLSearchParams(location.search).has('art')) {
  void import('./ui/dev/ArtPreview.svelte').then(({ default: ArtPreview }) => mount(ArtPreview, { target }));
} else {
  mount(App, { target });
}
