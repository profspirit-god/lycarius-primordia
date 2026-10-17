// Content manifest: the ONE place new skills / classes get registered.
import { SkillRegistry } from '../skills/SkillRegistry.js';
import { ClassRegistry } from '../classes/ClassRegistry.js';
import { Fireball } from '../skills/Fireball.js';
import { FlameShield } from '../skills/FlameShield.js';
import { BurnResistance } from '../skills/BurnResistance.js';
import { Mage } from '../classes/Mage.js';

SkillRegistry.register(Fireball);
SkillRegistry.register(FlameShield);
SkillRegistry.register(BurnResistance);
ClassRegistry.register(Mage);
