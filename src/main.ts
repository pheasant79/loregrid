import './styles.css';
import demoTree from '../data/loregrid-demo.json';
import { LoregridApp } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root.');

new LoregridApp(root, demoTree);
