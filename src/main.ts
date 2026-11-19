import './styles.css';
import { LoregridApp } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root.');

new LoregridApp(root, __LOREGRID_INITIAL_TREE__);
