"""SprintZero Analyzer — Terminal UI for bidirectional sprint end detection."""

import numpy as np
from pathlib import Path

from textual.app import App
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import Header, Footer, DirectoryTree, DataTable, Static
from textual_plotext import PlotextPlot

from detection import analyze_file


class SprintZeroTree(DirectoryTree):
    """Directory tree filtered to .sprintzero files."""

    def filter_paths(self, paths):
        return [
            p for p in paths
            if p.is_dir() or p.suffix == '.sprintzero'
        ]


class SprintZeroAnalyzer(App):
    CSS = """
    Screen {
        layout: horizontal;
    }
    #sidebar {
        width: 35;
        dock: left;
        border-right: solid $primary;
    }
    #main {
        width: 1fr;
    }
    #results-table {
        height: 1fr;
        min-height: 8;
    }
    #plot {
        height: 1fr;
        min-height: 10;
    }
    #status {
        height: 1;
        dock: bottom;
        background: $surface;
        color: $text-muted;
        padding: 0 1;
    }
    DataTable {
        height: 100%;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Quit"),
    ]

    TITLE = "SprintZero Analyzer"

    def __init__(self):
        super().__init__()
        self._results = []

    def compose(self):
        yield Header()
        with Horizontal():
            with Vertical(id="sidebar"):
                yield SprintZeroTree(
                    Path("/Users/radim/Programming/SprintZeroProject/DeviceData"),
                    id="tree",
                )
            with Vertical(id="main"):
                yield DataTable(id="results-table")
                yield PlotextPlot(id="plot")
        yield Static("Select a .sprintzero file to analyze", id="status")
        yield Footer()

    def on_mount(self):
        table = self.query_one("#results-table", DataTable)
        table.cursor_type = "row"
        table.add_columns("#", "Date", "Dist", "Fwd (s)", "Bwd (s)", "Gap", "Decision", "Final (s)")

    def on_directory_tree_file_selected(self, event: DirectoryTree.FileSelected):
        path = event.path
        if path.suffix != '.sprintzero':
            return

        status = self.query_one("#status", Static)
        status.update(f"Analyzing {path.name}...")

        table = self.query_one("#results-table", DataTable)
        table.clear()

        self._clear_plot()

        try:
            self._results = analyze_file(path)
        except Exception as e:
            status.update(f"Error: {e}")
            self._results = []
            return

        if not self._results:
            status.update(f"No sprints with sensor data found in {path.name}")
            return

        for r in self._results:
            table.add_row(
                str(r['index']),
                r['date'],
                str(r['distance']),
                f"{r['fwd_dur']:.2f}",
                f"{r['bwd_dur']:.2f}",
                f"{r['gap']:.2f}",
                r['decision'],
                f"{r['final_dur']:.2f}",
            )

        status.update(f"{path.name} — {len(self._results)} sprint(s)")

        # Auto-select first row
        if self._results:
            self._plot_sprint(0)

    def on_data_table_row_selected(self, event: DataTable.RowSelected):
        row_index = event.cursor_row
        if 0 <= row_index < len(self._results):
            self._plot_sprint(row_index)

    def _clear_plot(self):
        plot_widget = self.query_one("#plot", PlotextPlot)
        plt = plot_widget.plt
        plt.clear_figure()
        plt.title("No data")
        plot_widget.refresh()

    def _plot_sprint(self, row_index):
        r = self._results[row_index]
        pd = r['plot_data']
        t = pd['t']
        rolling = pd['rolling']

        plot_widget = self.query_one("#plot", PlotextPlot)
        plt = plot_widget.plt
        plt.clear_figure()

        # Filter out NaN values for plotting
        valid = ~np.isnan(rolling)
        t_valid = t[valid].tolist()
        r_valid = rolling[valid].tolist()

        plt.plot(t_valid, r_valid, label="Rolling mean")
        plt.hline(pd['threshold'], color="magenta")
        plt.vline(pd['fwd_time'], color="red")
        plt.vline(pd['bwd_time'], color="green")
        plt.vline(pd['final_time'], color="white")

        plt.title(f"{r['distance']}m ({r['date']}) — Final: {r['final_dur']:.2f}s")
        plt.xlabel("Time (s)")
        plt.ylabel("Accel (g)")

        plot_widget.refresh()


def main():
    app = SprintZeroAnalyzer()
    app.run()


if __name__ == "__main__":
    main()
