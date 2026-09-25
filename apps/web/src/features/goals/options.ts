import { goalPriority, goalType } from '@finpilot/shared';
import { humanize } from '../../lib/format';

export const goalTypeOptions = goalType.options.map((v) => ({ value: v, label: humanize(v) }));
export const priorityOptions = goalPriority.options.map((v) => ({ value: v, label: humanize(v) }));
