import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAW_DIR = fileURLToPath(new URL('../../../../data/raw/', import.meta.url));

export const rawFile = (name: string) => readFileSync(RAW_DIR + name, 'utf8');

const SAMPLES_DIR = fileURLToPath(new URL('../../../../data/samples/', import.meta.url));

export const sampleFile = (name: string) => readFileSync(SAMPLES_DIR + name, 'utf8');
