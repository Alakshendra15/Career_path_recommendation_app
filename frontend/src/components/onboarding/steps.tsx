import { useState } from 'react';
import { ALL_STATES, getCitiesForState } from '../../constants/india-locations';
import { INTEREST_OPTIONS, SKILL_OPTIONS } from '../../constants/options';
import { useOnboarding, type StepId } from '../../store/onboarding';
import { Input, OptionCard, SelectField, SelectSheet } from '../ui';
import { SkillPicker } from './SkillPicker';

export const STEP_INFO: Record<StepId, { title: string; sub: string }> = {
  personal: { title: 'Tell us about yourself', sub: 'We use this to personalise your analysis.' },
  education: { title: 'What level are you studying at?', sub: 'Pick the one closest to you.' },
  location: { title: 'Where are you based?', sub: 'This helps with relevant opportunities.' },
  skills: { title: 'What skills do you have?', sub: 'Add every technology and tool you know. This is the most important step.' },
  interests: { title: 'What interests you?', sub: 'Optional, but it sharpens the recommendations.' },
  experience: { title: 'How have you learned so far?', sub: 'Be honest, there is no wrong answer.' },
  projects: { title: 'Tell us about a project', sub: 'Your best project and the technologies you used.' },
};

function PersonalStep() {
  const { name, age, set } = useOnboarding();
  return (
    <>
      <Input label="Full name" value={name} onChangeText={(v) => set('name', v)} autoCapitalize="words" placeholder="Rahul Sharma" />
      <Input label="Age" value={age} onChangeText={(v) => set('age', v.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="21" />
    </>
  );
}

function EducationStep() {
  const { education, set } = useOnboarding();
  return (
    <>
      <OptionCard icon="school" title="Undergraduate" description="Pursuing or completed B.Tech, B.Sc, BCA, B.E. and similar" selected={education === 'undergraduate'} onPress={() => set('education', 'undergraduate')} />
      <OptionCard icon="ribbon" title="Graduate" description="Completed a bachelor's degree" selected={education === 'graduate'} onPress={() => set('education', 'graduate')} />
      <OptionCard icon="medal" title="Postgraduate" description="Pursuing or completed M.Tech, M.Sc, MBA, MCA and similar" selected={education === 'postgraduate'} onPress={() => set('education', 'postgraduate')} />
    </>
  );
}

function LocationStep() {
  const { state, city, set } = useOnboarding();
  const [open, setOpen] = useState<'state' | 'city' | null>(null);
  return (
    <>
      <SelectField label="State" value={state} placeholder="Select your state" onPress={() => setOpen('state')} />
      <SelectField label="City" value={city} placeholder={state ? 'Select your city' : 'Choose a state first'} disabled={!state} onPress={() => setOpen('city')} />
      <SelectSheet
        visible={open === 'state'}
        title="Select state"
        options={ALL_STATES}
        selected={state}
        onClose={() => setOpen(null)}
        onSelect={(v) => {
          if (v !== state) set('city', ''); // a city from the old state is no longer valid
          set('state', v);
        }}
      />
      <SelectSheet
        visible={open === 'city'}
        title={`Cities in ${state}`}
        options={getCitiesForState(state)}
        selected={city}
        onClose={() => setOpen(null)}
        onSelect={(v) => set('city', v)}
      />
    </>
  );
}

function SkillsStep() {
  const { skills, set } = useOnboarding();
  return <SkillPicker selected={skills} onChange={(v) => set('skills', v)} options={SKILL_OPTIONS} placeholder="Search skills, e.g. Python" max={100} />;
}

function InterestsStep() {
  const { interests, set } = useOnboarding();
  return <SkillPicker selected={interests} onChange={(v) => set('interests', v)} options={INTEREST_OPTIONS} placeholder="Search interests, e.g. data" max={20} />;
}

function ExperienceStep() {
  const { experienceType, set } = useOnboarding();
  return (
    <>
      <OptionCard icon="book" title="Theoretical" description="Classroom learning, courses and self-study. No project experience yet." selected={experienceType === 'theoretical'} onPress={() => set('experienceType', 'theoretical')} />
      <OptionCard icon="code-slash" title="Practical" description="Built real projects: personal, college, freelance or internship." selected={experienceType === 'practical'} onPress={() => set('experienceType', 'practical')} />
    </>
  );
}

function ProjectsStep() {
  const { projectTitle, techStack, set } = useOnboarding();
  return (
    <>
      <Input label="Project title" value={projectTitle} onChangeText={(v) => set('projectTitle', v)} autoCapitalize="sentences" placeholder="e.g. Sales dashboard" />
      <SkillPicker selected={techStack} onChange={(v) => set('techStack', v)} options={SKILL_OPTIONS} placeholder="Technologies you used" max={30} />
    </>
  );
}

export const STEP_COMPONENTS: Record<StepId, () => React.JSX.Element> = {
  personal: PersonalStep,
  education: EducationStep,
  location: LocationStep,
  skills: SkillsStep,
  interests: InterestsStep,
  experience: ExperienceStep,
  projects: ProjectsStep,
};
