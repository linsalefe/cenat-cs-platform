import TriggerNode from './TriggerNode';
import ActionNode from './ActionNode';
import ConditionNode from './ConditionNode';
import DelayNode from './DelayNode';
import WaitForReplyNode from './WaitForReplyNode';
import SendWhatsAppButtonsNode from './SendWhatsAppButtonsNode';
import { NODE_DEFINITIONS } from '../node-definitions';

/* Mapeia cada tipo registrado para seu componente de render.
   Cada node_definition.type é uma chave independente no React Flow.

   Exceções:
   - action.wait_for_reply: 2 handles fixos (Respondeu / Não respondeu)
   - action.send_whatsapp_buttons: N+1 handles dinâmicos (1 por botão + timeout) */
export const nodeTypes = Object.fromEntries(
  Object.values(NODE_DEFINITIONS).map((def) => {
    let component;
    if (def.type === 'action.wait_for_reply') {
      component = WaitForReplyNode;
    } else if (def.type === 'action.send_whatsapp_buttons') {
      component = SendWhatsAppButtonsNode;
    } else if (def.kind === 'trigger') {
      component = TriggerNode;
    } else if (def.kind === 'action') {
      component = ActionNode;
    } else if (def.kind === 'condition') {
      component = ConditionNode;
    } else {
      component = DelayNode;
    }
    return [def.type, component];
  })
);

export {
  TriggerNode,
  ActionNode,
  ConditionNode,
  DelayNode,
  WaitForReplyNode,
  SendWhatsAppButtonsNode,
};
