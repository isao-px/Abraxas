#!/usr/bin/env bash

# Script pulled from https://xieme-art.org/post/bash-avance-barre-de-progression/ and adapted to Abraxas' needs.
# This script was first edited by cavo789 on https://www.avonture.be/blog/bash-progression-bar/
set -o nounset
set -o errexit

# The different bar to display (done)
PROGRESS_BAR_CHAR=(█ ▒)

# Show or not the introduction text (f.i. "Doing some stuff")
PROGRESS_BAR_DISPLAY_INFO=1

PROGRESS_BAR_DISPLAY_COMP=1

# Display template
PROGRESS_BAR_INFO_TEMPLATE=' %s [ %3d/%3d ] '
PROGRESS_BAR_COMP_TEMPLATE=' %3d%% '
PROGRESS_BAR_TEMPLATE='\033[1m%s%s\033[0m%s%s\r'

# region - private function progress_bar::__change_column_size
#
# ## Description
#
# This function will capture de WINCH signal. That one is fired by Linux when
# the size of the window (i.e. the console) is updated so allow us to retrieve the
# max. number of columns that can fit in the window.
#
# endregion
function progress_bar::__change_column_size() {
    printf >&2 "%${COLUMNS}s" ""
    printf >&2 "\033[0K\r"
    COLUMNS=$(tput cols)
}

# region - private function progress_bar::__draw
#
# ## Description
#
# Draw the progress bar / progression
#
# endregion
function progress_bar::__draw() {
    # function parameters
    local -r progress=${1?"progress is mandatory"}
    local -r total=${2?"total elements is mandatory"}
    local -r info=${3:-"In progress"}

    # function local variables
    local progress_segment
    local todo_segment
    local info_segment=""
    local comp_segment=""

    if [[ ${PROGRESS_BAR_DISPLAY_INFO:-1} -eq 1 ]]; then
        printf -v info_segment "${PROGRESS_BAR_INFO_TEMPLATE}" \
            "$info" "$progress" "$total"
    fi

    local -r progress_ratio=$((progress * 100 / total))
    if [[ ${PROGRESS_BAR_DISPLAY_COMP:-0} -eq 1 ]]; then
        printf -v comp_segment "${PROGRESS_BAR_COMP_TEMPLATE}" \
            "$progress_ratio"
    fi

    # progress bar construction
    # calculate each element sizes, bar must fit in ou screen
    local -r bar_size=$((COLUMNS - ${#info_segment} - ${#comp_segment}))
    local -r progress_segment_size=$((bar_size * progress_ratio / 100))
    local -r todo_segment_size=$((bar_size - progress_segment_size))
    printf -v progress_segment "%${progress_segment_size}s" ""
    printf -v todo_segment "%${todo_segment_size}s" ""

    printf >&2 "$PROGRESS_BAR_TEMPLATE" \
        "$info_segment" \
        "${progress_segment// /${PROGRESS_BAR_CHAR[0]}}" \
        "${todo_segment// /${PROGRESS_BAR_CHAR[1]}}" \
        "$comp_segment"
}

function progress_bar::process() {
    local -r action="${1:-Upload in progress}"
    local -r max=${2:-100}

    # Capture the resize of the window so the progress bar becomes responsive
    trap progress_bar::__change_column_size WINCH

    while read -r line; do
        # Each line with "Progress=(digit)" will increase the progress bar
        if [[ $line =~ Progress=([[:digit:]]{1,}) ]]; then
            progress_bar::__draw "${BASH_REMATCH[1]}" "${max}" "${action}"
        fi
    done
}

# This script didn't contains executable code; only helpers.
sourced=0
(return 0 2> /dev/null) && sourced=1 || sourced=0
if [ "${sourced}" -eq "0" ]; then
    printf "\033[1;31m%s\033[0m\n" "ERROR, the $0 script is meant to be sourced. Try 'source $0' and use public functions." >&2 # Write on stderr
    exit 1
fi

return 0