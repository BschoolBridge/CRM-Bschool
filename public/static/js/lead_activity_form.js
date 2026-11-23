(function ($) {
    'use strict';

    var OUTCOME_VISIT_SCHEDULED = 'Visit scheduled';
    var VISIT_NEXT_ACTION_CODE = 'SCHEDULE_VISIT';
    var initialized = false;

    function $outcome() {
        return $('#id_outcome_preset');
    }

    function showNextActionFields(show) {
        var $fields = $('#next-action-fields');
        if (!$fields.length) {
            return;
        }
        if (show) {
            $fields.stop(true, true).show();
            $('#id_is_completed').prop('checked', true).prop('disabled', true);
            $('#id_followup_date').prop('required', true);
            $('#id_next_action').prop('required', true);
        } else {
            $fields.stop(true, true).hide();
            $('#id_is_completed').prop('disabled', false);
            $('#id_followup_date').prop('required', false);
            $('#id_next_action').prop('required', false);
        }
    }

    function hasNextActionYes() {
        var $checked = $('input[name="has_next_action"]:checked');
        return $checked.length && $checked.val() === 'yes';
    }

    function toggleOutcomeOther() {
        var v = $outcome().val();
        $('#outcome-other-wrap').toggle(v === '__OTHER__');
    }

    function selectVisitScheduledNextAction() {
        var $na = $('#id_next_action');
        if (!$na.length) {
            return;
        }
        if ($na.find('option[value="SCHEDULE_VISIT"]').length) {
            $na.val('SCHEDULE_VISIT');
            return;
        }
        $na.find('option').each(function () {
            var label = ($(this).text() || '').trim();
            if (/visit scheduled/i.test(label)) {
                $na.val($(this).val());
                return false;
            }
        });
    }

    function openVisitModal() {
        var $modal = $('#scheduleVisitActivityModal');
        if (!$modal.length) {
            return;
        }
        var existing = $('#id_followup_date').val();
        if (existing) {
            $('#schedule_visit_datetime').val(existing);
        }
        $modal.modal('show');
        setTimeout(function () {
            $('#schedule_visit_datetime').trigger('focus');
        }, 300);
    }

    function applyVisitScheduledOutcome(openModal) {
        var $yes = $('input[name="has_next_action"][value="yes"]');
        if ($yes.length) {
            $yes.prop('checked', true);
        }
        showNextActionFields(true);
        selectVisitScheduledNextAction();
        if (openModal) {
            openVisitModal();
        }
    }

    function onHasNextActionChange() {
        showNextActionFields(hasNextActionYes());
    }

    function onOutcomeChange() {
        toggleOutcomeOther();
        if ($outcome().val() === OUTCOME_VISIT_SCHEDULED) {
            applyVisitScheduledOutcome(true);
        }
    }

    function saveVisitFromModal() {
        var visitDt = ($('#schedule_visit_datetime').val() || '').trim();
        if (!visitDt) {
            alert('Please choose the visit date and time.');
            $('#schedule_visit_datetime').focus();
            return;
        }
        $('#id_followup_date').val(visitDt);
        $('#scheduleVisitActivityModal').modal('hide');
    }

    function bindLeadActivityForm() {
        var $form = $outcome().closest('form');
        if (!$form.length) {
            $form = $('#lead-activity-form');
        }

        $outcome().off('.leadActivity').on('change.leadActivity', onOutcomeChange);
        $('input[name="has_next_action"]')
            .off('.leadActivity')
            .on('change.leadActivity click.leadActivity', onHasNextActionChange);
        $('#schedule_visit_save_btn')
            .off('.leadActivity')
            .on('click.leadActivity', saveVisitFromModal);

        if ($form.length) {
            $form.off('submit.leadActivity').on('submit.leadActivity', function (e) {
                $('#id_is_completed').prop('disabled', false);
                if ($outcome().val() !== OUTCOME_VISIT_SCHEDULED) {
                    return;
                }
                if (($('#id_followup_date').val() || '').trim()) {
                    return;
                }
                e.preventDefault();
                applyVisitScheduledOutcome(true);
                alert('Please set the visit date and time.');
            });
        }

        toggleOutcomeOther();
        onHasNextActionChange();

        if ($outcome().val() === OUTCOME_VISIT_SCHEDULED) {
            applyVisitScheduledOutcome(false);
        }
    }

    window.initLeadActivityForm = function () {
        if (initialized || !$outcome().length) {
            return;
        }
        initialized = true;
        bindLeadActivityForm();
    };

    function boot() {
        if ($outcome().length) {
            initLeadActivityForm();
        }
    }

    if ($ && $.fn) {
        $(boot);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}(window.jQuery));
