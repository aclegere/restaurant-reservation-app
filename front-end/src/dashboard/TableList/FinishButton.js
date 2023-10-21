import React from "react";
import { unassignTable } from "../../utils/api";
import { useHistory } from "react-router";

export default function FinishButton({ status, table, loadDashboard }) {
  const history = useHistory();

  async function handleClick() {
    return window.confirm(
      "Is this table ready to seat new guests? This cannot be undone."
    )
      ? await handleFinish(table.table_id, table.reservation_id)
      : null;
  }

  async function handleFinish(table_id, reservation_id) {
    await unassignTable(table_id, reservation_id);
    await loadDashboard();
    history.push("/dashboard");
  }

  return (
    status === "Occupied" && (
      <td>
        <button
          data-table-id-finish={table.table_id}
          type="button"
          onClick={handleClick}
          className="btn btn-sm btn-primary">
          Finish
        </button>
      </td>
    )
  );
}
