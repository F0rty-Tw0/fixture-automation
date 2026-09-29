/** Where a step sits on the pipeline rail. */
export type StepState = 'pending' | 'active' | 'done';

/** Rail state of the six studio steps; the last three belong to the endpoint chosen in Generate. */
export type StudioSteps = {
  readonly spec: StepState;
  readonly endpoints: StepState;
  readonly generate: StepState;
  readonly compare: StepState;
  readonly missing: StepState;
  readonly fill: StepState;
};

/** How far the studio got, as the rail reads it. */
export type StudioProgress = {
  readonly hasSpec: boolean;
  readonly hasFixtures: boolean;
  readonly hasDiff: boolean;
  /** The diff left values to fill and the user moved on from the missing values to AI fill. */
  readonly isFilling: boolean;
  readonly hasMerge: boolean;
};
