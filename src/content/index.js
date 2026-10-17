// Content manifest: the ONE place new skills / classes get registered.
import { SkillRegistry } from '../skills/SkillRegistry.js';
import { ClassRegistry } from '../classes/ClassRegistry.js';
import { Fireball } from '../skills/Fireball.js';
import { Mage } from '../classes/Mage.js';

SkillRegistry.register(Fireball);
ClassRegistry.register(Mage);
