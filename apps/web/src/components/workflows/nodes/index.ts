import TriggerNode from './TriggerNode';
import ActionNode from './ActionNode';
import ConditionNode from './ConditionNode';
import DelayNode from './DelayNode';
import WaitForReplyNode from './WaitForReplyNode';
import { NODE_DEFINITIONS } from '../node-definitions';

/* Mapeia cada tipo registrado para seu componente de render.
   Cada node_definition.type é uma chave independente no React Flow.

   Exceção: action.wait_for_reply usa o componente especial com 2 handles
   (Respondeu / Não respondeu), parecido com ConditionNode. */
export const nodeTypes = Object.fromEntries(
  Object.values(NODE_DEFINITIONS).map((def) => {
    let component;
    if (def.type === 'action.wait_for_reply') {
      component = WaitForReplyNode;
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

export { TriggerNode, ActionNode, ConditionNode, DelayNode, WaitForReplyNode };
