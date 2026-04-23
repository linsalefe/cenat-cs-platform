import TriggerNode from './TriggerNode';
import ActionNode from './ActionNode';
import ConditionNode from './ConditionNode';
import DelayNode from './DelayNode';
import { NODE_DEFINITIONS } from '../node-definitions';

/* Mapeia cada tipo registrado para seu componente de render.
   Cada node_definition.type é uma chave independente no React Flow. */
export const nodeTypes = Object.fromEntries(
  Object.values(NODE_DEFINITIONS).map((def) => {
    const component =
      def.kind === 'trigger'
        ? TriggerNode
        : def.kind === 'action'
        ? ActionNode
        : def.kind === 'condition'
        ? ConditionNode
        : DelayNode;
    return [def.type, component];
  })
);

export { TriggerNode, ActionNode, ConditionNode, DelayNode };
