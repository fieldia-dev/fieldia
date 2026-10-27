import type { Replays } from './hand';
import { replay as backlog } from './operations/backlog';
import { replay as activityLog } from './operations/activity-log';
import { replay as workItem } from './operations/work-item';
import { replay as agentTools } from './operations/agent-tools';
import { replay as templateTask } from './operations/template-task';
import { replay as templatePurchaseOrder } from './operations/template-purchase-order';
import { replay as realTask } from './operations/real-task';
import { replay as realTransfer } from './operations/real-transfer';
import { replay as realManufacturingOrder } from './operations/real-manufacturing-order';
import { replay as realMaintenanceRequest } from './operations/real-maintenance-request';
import { replay as realLegalCase } from './operations/real-legal-case';
import { replay as mapCouriers } from './operations/map-couriers';
import { replay as mapRound } from './operations/map-round';
import { replay as mapOrder } from './operations/map-order';
import { replay as mapKitchen } from './operations/map-kitchen';
import { replay as stockCount } from './operations/stock-count';
import { replay as fitoutPlan } from './operations/fitout-plan';

/** The operations demos' how-to steps, replayed by hand (e2e/how-to.spec.ts): one file each in e2e/how-to/operations/, in the catalogue's order. */
export const operations: Replays = {
  backlog,
  'activity-log': activityLog,
  'work-item': workItem,
  'agent-tools': agentTools,
  'template-task': templateTask,
  'template-purchase-order': templatePurchaseOrder,
  'real-task': realTask,
  'real-transfer': realTransfer,
  'real-manufacturing-order': realManufacturingOrder,
  'real-maintenance-request': realMaintenanceRequest,
  'real-legal-case': realLegalCase,
  'map-couriers': mapCouriers,
  'map-round': mapRound,
  'map-order': mapOrder,
  'map-kitchen': mapKitchen,
  'stock-count': stockCount,
  'fitout-plan': fitoutPlan,
};
