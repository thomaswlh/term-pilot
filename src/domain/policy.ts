import { ADMISSION_COHORTS, type AdmissionCohort } from "./academic";

export type PolicyStatus =
  | "rule"
  | "guidance"
  | "needs-approval"
  | "sources-disagree"
  | "outside-termpilot";

export type PolicyCohortScope = "unscoped" | "confirmed-for-cohort";

export type PolicySource = {
  title: string;
  url: string;
  section: string;
  page: string | null;
  date: string;
};

export type PolicyCard = {
  id: string;
  statement: string;
  status: PolicyStatus;
  cohortScope: PolicyCohortScope;
  sources: PolicySource[];
};

const HANDBOOK_URL =
  "https://reg.um.edu.mo/download/course-enrol-info/gen-info/Course%20Enrolment%20HandBook.pdf";
const HANDBOOK_DATE = "2026-09-14";
const HANDBOOK_TITLE = "Course Enrolment HandBook";

const REGISTRY_URL =
  "https://reg.um.edu.mo/current-students/enrolment-and-examinations/course-enrolment/general-information/";
const REGISTRY_DATE = "2026-11-11";
const REGISTRY_TITLE = "Registry general-information page";

const SOCIETY_AND_BEHAVIOUR_URL =
  "https://reg.um.edu.mo/current-students/curriculum-model/ug-curriculum-model/general-education/2017-2018/society-and-behaviour/";

const UNSCOPED_BINDING =
  "The source does not name an academic year, so the statement is not confirmed for the student's admission cohort.";

const GE_CONFIRMED_BINDING =
  "The handbook states this for the GE programme from 2017/2018 onward, and the saved cohort falls in that range. TermPilot does not decide whether the total is 24 or 27.";

const GE_NOT_CONFIRMED_BINDING =
  "The handbook limits the statement to the GE programme from 2017/2018 onward, and it is not confirmed for this profile.";

const CONFIRMED_GE_START = ADMISSION_COHORTS.indexOf("2017/2018");
const CONFIRMED_GE_END = ADMISSION_COHORTS.indexOf("2026/2027");

function handbook(section: string, page: string): PolicySource {
  return {
    title: HANDBOOK_TITLE,
    url: HANDBOOK_URL,
    section,
    page,
    date: HANDBOOK_DATE,
  };
}

function registry(section: string): PolicySource {
  return {
    title: REGISTRY_TITLE,
    url: REGISTRY_URL,
    section,
    page: null,
    date: REGISTRY_DATE,
  };
}

export const POLICY_CARDS: readonly PolicyCard[] = [
  {
    id: "language-test-out",
    status: "needs-approval",
    cohortScope: "unscoped",
    statement:
      "English is 0–9 credits. Chinese or Portuguese is 0–3. Testing out needs an assessment and Faculty of Arts and Humanities permission. The credits are made up with free electives.",
    sources: [handbook("§3.2", "6–7")],
  },
  {
    id: "information-technology",
    status: "rule",
    cohortScope: "unscoped",
    statement: "Students cannot test out of CSCI1000.",
    sources: [handbook("§3.2", "7")],
  },
  {
    id: "ge-size",
    status: "rule",
    cohortScope: "confirmed-for-cohort",
    statement:
      "The 24-or-27 structure, four compulsory areas, remaining credits across those areas, extra GE later counting as free electives, no double-counting, and no GE substitution are stated for the GE programme from 2017/2018 onward. The 24-versus-27 total depends on the faculty or programme. TermPilot does not choose which total applies.",
    sources: [handbook("§3.3.2", "9–10")],
  },
  {
    id: "society-area",
    status: "sources-disagree",
    cohortScope: "unscoped",
    statement:
      `Handbook §3.3.1, printed page 8, names GESB1017 / GESB1018. Handbook §3.3.2, printed page 9, also names "Ethics, Values, Law and Society." The Registry general-information page ${REGISTRY_URL}, retrieved ${REGISTRY_DATE}, describes GESB1001, GESB1002, and GESB1003 for the 2017/2018 curriculum model and links to ${SOCIETY_AND_BEHAVIOUR_URL}. TermPilot quotes both accounts and does not choose a course list.`,
    sources: [
      handbook("§3.3.1", "8"),
      handbook("§3.3.2", "9"),
      registry("Ethics, Values, Law and Society"),
    ],
  },
  {
    id: "course-load",
    status: "guidance",
    cohortScope: "unscoped",
    statement:
      "The normal semester maximum is 21 credits besides Community and Peer Education. A load of 24 requires a cumulative GPA of at least 2.0 and faculty approval. The same section lists different maxima for some programmes, including Faculty of Law. TermPilot does not know GPA or approval, so it does not enforce a load.",
    sources: [handbook("§6", "17")],
  },
  {
    id: "year-and-course-number",
    status: "guidance",
    cohortScope: "unscoped",
    statement:
      "The first digit is the course's level, and the four-letter plus four-digit form dates from 2018/2019. Enrolment priority runs from Year 4 to Year 1. Compulsory-major timing comes from the academic unit's study plan.",
    sources: [
      registry("General information"),
      handbook("§5.1", "14"),
      handbook("section 4, Course Types", "11"),
    ],
  },
  {
    id: "outside-this-assistant",
    status: "outside-termpilot",
    cohortScope: "unscoped",
    statement:
      "Handbook §5.2, printed page 16, directs students to their study plan and the General Rules Governing Bachelor's Degree Programmes. Handbook §8.5, printed page 20, states the Residential College requirement. Handbook FAQ 8.4, printed page 20, describes quota by course type. Graduation, study-plan completion, Residential College requirements, and quota by course type stay with the academic unit and the Registry.",
    sources: [
      handbook("§5.2", "16"),
      handbook("§8.5", "20"),
      handbook("FAQ 8.4", "20"),
      registry("General information"),
    ],
  },
];

function cohortInConfirmedGeRange(cohort: AdmissionCohort): boolean {
  const index = ADMISSION_COHORTS.indexOf(cohort);
  return index >= CONFIRMED_GE_START && index <= CONFIRMED_GE_END;
}

export function policyBinding(card: PolicyCard, cohort: AdmissionCohort | null): string {
  if (card.id !== "ge-size") {
    return UNSCOPED_BINDING;
  }
  if (cohort !== null && cohortInConfirmedGeRange(cohort)) {
    return GE_CONFIRMED_BINDING;
  }
  return GE_NOT_CONFIRMED_BINDING;
}
