import { IInputs } from "./generated/ManifestTypes";
import { IMaintenanceActivity, ITask } from "./interfaces/IPriorityTasksBoard";

type DataSet = ComponentFramework.PropertyTypes.DataSet;

enum PriorityLevel {
    High = 455220000,
    Medium = 455220001,
    Low = 455220002
}

const priorityMap: Record<number, "High" | "Medium" | "Low"> = {
    [PriorityLevel.High]: "High",
    [PriorityLevel.Medium]: "Medium",
    [PriorityLevel.Low]: "Low"
};

const mapPriorityToLabel = (v: number): "High" | "Medium" | "Low" =>
    priorityMap[v] ?? "Low";

const getCurrentUserId = (context: ComponentFramework.Context<IInputs>): string => {
    const userId = context.userSettings.userId.replace(/[{}]/g, "");
    console.log("Current user ID:", userId);
    return userId;
};

/**
 * fetch inspections from DataSet (already filtered by the view)
 */
export const parseInspectionsFromDataSet = (dataSet: DataSet): ITask[] => {
    const inspections: ITask[] = [];

    const recordIds = dataSet?.sortedRecordIds ?? [];
    if (recordIds.length === 0) {
        console.log("No inspection records in dataset");
        return inspections;
    }

    recordIds.forEach((recordId) => {
        const record = dataSet.records[recordId];
        
        // Get column values
        const inspectionId = record.getRecordId();
        const code = record.getFormattedValue("apex_code") || `INS-${inspectionId.substring(0, 8)}`;
        const priorityLevel = record.getValue("apex_prioritylevel") as number || 455220002;
        const startDate = record.getValue("apex_startdate") as string;
        const endDate = record.getValue("apex_enddate") as string;
        const expectedEndDate = record.getValue("apex_expectedenddate") as string;
        const estimatedCost = record.getValue("apex_estimatedrepaircost") as number;
        const statusCode = record.getValue("statuscode") as number || 0;
        const statusFormatted = record.getFormattedValue("statuscode") || "Unknown";
        const stateCode = record.getValue("statecode") as number || 0;
        const assignedInspector = record.getFormattedValue("apex_assignedinspector") || "Unassigned";
        const caseId = record.getValue("apex_case") as string;
        const caseName = record.getFormattedValue("apex_case");

        inspections.push({
            id: inspectionId,
            taskId: code,
            name: code,
            type: "Inspection",
            priority: mapPriorityToLabel(priorityLevel),
            priorityValue: priorityLevel,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
            status: statusFormatted,
            statusCode: statusCode,
            statusCodeFormatted: statusFormatted,
            stateCode: stateCode,
            assignedTo: assignedInspector,
            assignedToId: record.getValue("apex_assignedinspector") as string || "",
            estimatedCost: estimatedCost,
            caseId: caseId,
            relatedCaseName: caseName
        });
    });

    console.log(`Parsed ${inspections.length} inspections from dataset`);
    return inspections;
};

/**
 * fetch all maintenance activities assigned to the current user via WebAPI
 */
export const fetchMaintenanceActivities = async (
    context: ComponentFramework.Context<IInputs>
): Promise<ITask[]> => {
    try {
        const currentUserId = getCurrentUserId(context);
        
        const fetchXml = `
            <fetch>
                <entity name="apex_maintenanceactivity">
                    <attribute name="apex_activitydescription" />
                    <attribute name="apex_actualcost" />
                    <attribute name="apex_assignedtechnician" />
                    <attribute name="apex_enddate" />
                    <attribute name="apex_maintenanceactivityid" />
                    <attribute name="apex_maintenanceactualenddate" />
                    <attribute name="apex_name" />
                    <attribute name="apex_prioritylevel" />
                    <attribute name="apex_startdate" />
                    <attribute name="apex_case" />
                    <attribute name="statecode" />
                    <attribute name="statuscode" />
                    <filter>
                        <condition attribute="apex_assignedtechnician" operator="eq" value="${currentUserId}" />
                        <condition attribute="statecode" operator="eq" value="0" />
                    </filter>
                    <link-entity name="systemuser" from="systemuserid" to="apex_assignedtechnician" alias="technician">
                        <attribute name="fullname" />
                    </link-entity>
                </entity>
            </fetch>
        `;

        const encodedFetchXml = encodeURIComponent(fetchXml);
        const result = await context.webAPI.retrieveMultipleRecords(
            "apex_maintenanceactivity",
            `?fetchXml=${encodedFetchXml}`
        );

        console.log(`Fetched ${result.entities.length} maintenance activities from WebAPI`);

        return result.entities.map((entity: ComponentFramework.WebApi.Entity): ITask => {
            const activity = entity as unknown as IMaintenanceActivity;
            return {
                id: activity.apex_maintenanceactivityid,
                taskId: activity.apex_name ?? `MA-${activity.apex_maintenanceactivityid.substring(0, 8)}`,
                name: activity.apex_name ?? "Unnamed Maintenance",
                type: "Maintenance",
                priority: mapPriorityToLabel(activity.apex_prioritylevel),
                priorityValue: activity.apex_prioritylevel,
                startDate: activity.apex_startdate ? new Date(activity.apex_startdate) : null,
                endDate: activity.apex_enddate ? new Date(activity.apex_enddate) : null,
                expectedEndDate: activity.apex_maintenanceactualenddate 
                    ? new Date(activity.apex_maintenanceactualenddate) 
                    : null,
                status: activity["statuscode@OData.Community.Display.V1.FormattedValue"] ?? "Unknown",
                statusCode: activity.statuscode,
                statusCodeFormatted: activity["statuscode@OData.Community.Display.V1.FormattedValue"] ?? "",
                stateCode: activity.statecode,
                assignedTo: activity["_apex_assignedtechnician_value@OData.Community.Display.V1.FormattedValue"] ?? "Unassigned",
                assignedToId: activity._apex_assignedtechnician_value ?? "",
                description: activity.apex_activitydescription,
                actualCost: activity.apex_actualcost,
                caseId: activity._apex_case_value,
                relatedCaseName: activity["_apex_case_value@OData.Community.Display.V1.FormattedValue"]
            };
        });
    } catch (error: unknown) {
        console.error("Error fetching maintenance activities:", error);
        throw error;
    }
};

/**
 * merge inspections from DataSet with maintenance activities from WebAPI
 */
export const fetchAllTasks = async (context: ComponentFramework.Context<IInputs>, inspectionDataSet: DataSet): Promise<ITask[]> => {
    try {
        const inspections = parseInspectionsFromDataSet(inspectionDataSet);
        
        const maintenanceActivities = await fetchMaintenanceActivities(context);

        const allTasks: ITask[] = [...inspections, ...maintenanceActivities];

        console.log(`Total tasks: ${allTasks.length} (${inspections.length} inspections + ${maintenanceActivities.length} maintenance)`);

        // priority first, then start date
        return allTasks.sort((a, b) => {
            if (a.priorityValue !== b.priorityValue) {
                return a.priorityValue - b.priorityValue;
            }
            const aDate = a.startDate ?? a.expectedEndDate ?? new Date("2099-12-31");
            const bDate = b.startDate ?? b.expectedEndDate ?? new Date("2099-12-31");
            return aDate.getTime() - bDate.getTime();
        });
    } catch (error: unknown) {
        console.error("Error fetching all tasks:", error);
        throw error;
    }
};