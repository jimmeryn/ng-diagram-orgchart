export interface DeleteConfirmation {
  readonly title: string;
  readonly sentences: readonly string[];
}

export interface DeleteSubject {
  readonly name: string | null;
  readonly role: string | null;
}

function buildTitle(subject: DeleteSubject): string {
  return subject.name ? `Delete ${subject.name}?` : 'Delete this vacant position?';
}

function buildRemovalSentence(subject: DeleteSubject): string {
  if (subject.name) return `${subject.name} will be removed from the chart.`;
  const role = subject.role ? `${subject.role} ` : '';
  return `This vacant ${role}position will be removed from the chart.`;
}

export function buildDeleteConfirmation(subject: DeleteSubject): DeleteConfirmation {
  return {
    title: buildTitle(subject),
    sentences: [buildRemovalSentence(subject), 'This cannot be undone.'],
  };
}
