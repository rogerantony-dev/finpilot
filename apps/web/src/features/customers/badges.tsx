import { Badge, type BadgeTone } from '../../components/ui';

const kycTone: Record<string, BadgeTone> = { VERIFIED: 'accent', PENDING: 'warn', REVIEW: 'loss' };

export function KycBadge({ status }: { status: string }) {
  return <Badge tone={kycTone[status] ?? 'neutral'}>KYC {status.toLowerCase()}</Badge>;
}

const segmentTone: Record<string, BadgeTone> = {
  HNI: 'accent',
  Affluent: 'neutral',
  Mass: 'muted',
};

export function SegmentBadge({ segment }: { segment: string }) {
  return <Badge tone={segmentTone[segment] ?? 'neutral'}>{segment}</Badge>;
}
