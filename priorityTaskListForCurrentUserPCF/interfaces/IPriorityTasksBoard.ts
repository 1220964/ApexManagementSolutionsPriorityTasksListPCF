import { IInputs } from "../generated/ManifestTypes";

type DataSet = ComponentFramework.PropertyTypes.DataSet;

export interface IPriorityTasksBoardProps {
    context: ComponentFramework.Context<IInputs>;
    inspectionDataSet: DataSet;
}

export interface ITask {
    id: string;
    taskId: string;
    name: string;
    type: 'Inspection' | 'Maintenance';
    priority: 'High' | 'Medium' | 'Low';
    priorityValue: number;
    startDate: Date | null;
    endDate: Date | null;
    expectedEndDate: Date | null;
    status: string;
    statusCode: number;
    statusCodeFormatted: string;
    stateCode: number;
    assignedTo: string;
    assignedToId: string;
    description?: string;
    actualCost?: number;
    estimatedCost?: number;
    caseId?: string;
    relatedCaseName?: string;
}

export interface IMaintenanceActivity {
    apex_maintenanceactivityid: string;
    apex_name: string;
    apex_activitydescription?: string;
    apex_actualcost?: number;
    apex_prioritylevel: number;
    apex_startdate?: string;
    apex_enddate?: string;
    apex_maintenanceactualenddate?: string;
    statecode: number;
    statuscode: number;
    apex_assignedtechnician?: string;
    "_apex_assignedtechnician_value"?: string;
    "_apex_assignedtechnician_value@OData.Community.Display.V1.FormattedValue"?: string;
    "statuscode@OData.Community.Display.V1.FormattedValue"?: string;
    "apex_prioritylevel@OData.Community.Display.V1.FormattedValue"?: string;
    "_apex_case_value"?: string;
    "_apex_case_value@OData.Community.Display.V1.FormattedValue"?: string;
}

export type FilterScope = 'today' | 'next7days' | 'all';
export type ViewMode = 'board' | 'route' | 'analytics';