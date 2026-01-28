declare module '../../components/charts/SkillRadarChart' {
  interface SkillRadarChartProps {
    skills: {
      problem_solving: number;
      communication: number;
      code_quality: number;
      technical_depth: number;
      system_design: number;
      behavioral: number;
    };
  }
  
  export default function SkillRadarChart(props: SkillRadarChartProps): JSX.Element;
}

declare module '../../components/charts/PerformanceTrendChart' {
  interface PerformanceTrendChartProps {
    scores: number[];
    dates: string[];
  }
  
  export default function PerformanceTrendChart(props: PerformanceTrendChartProps): JSX.Element;
}

declare module '../../components/charts/InterviewTimelineChart' {
  interface Interview {
    id: string;
    type: string;
    date: string;
    score: number;
    topics: string[];
    duration: number;
  }
  
  interface InterviewTimelineChartProps {
    interviews: Interview[];
  }
  
  export default function InterviewTimelineChart(props: InterviewTimelineChartProps): JSX.Element;
}

declare module '../../components/charts/SkillDistributionChart' {
  interface SkillDistributionChartProps {
    skills: {
      problem_solving: number;
      communication: number;
      code_quality: number;
      technical_depth: number;
      system_design: number;
      behavioral: number;
    };
  }
  
  export default function SkillDistributionChart(props: SkillDistributionChartProps): JSX.Element;
}
